#include <bits/stdc++.h>
using namespace std;

int main(){
    cin.tie(0);
    ios_base::sync_with_stdio(0);
    //start here
    int N = 5;
    vector<vector<int>> adjcent_matrix(N,vector<int>(N,0));
    vector<vector<int>> adjcent_list(N);
    vector<int> next(N);
    for(int i = 0;i < N;i++) next[i] = (i+1)%N;
    for(int i = 0;i < N;i++){
        for(int j = 0;j < N;j++){
            if(i < j){
                adjcent_list[i].push_back(j);
                adjcent_matrix[i][j] = true;
            }
        }
    }

    cout << next[1];

}